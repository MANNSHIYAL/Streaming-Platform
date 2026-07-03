import asyncio
import logging
import os
from aiokafka import AIOKafkaConsumer
from websockets.server import serve
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Track active WebSocket client connections
CONNECTED_CLIENTS = set()

async def kafka_consumer_task():
    logger.info("Entered the Kafka Consumer")
    # Read Kafka address injected by Docker Compose, default to localhost if run standalone
    kafka_broker = os.getenv("KAFKA_BROKER", "kafka:9092")
    kafka_topic = os.getenv("KAFKA_TOPIC", "video-processing-notifications")
    """Background task to continuously fetch messages from Kafka and broadcast to WebSockets."""
    consumer = AIOKafkaConsumer(
        kafka_topic,                    # Your Kafka Topic
        bootstrap_servers=[kafka_broker],    # Your Kafka Broker Address
        auto_offset_reset='earliest',   # Consumer Group ID
        enable_auto_commit=True,
        request_timeout_ms=5000,
        # api_version=(0, 10, 0),
        value_deserializer=lambda x: json.loads(x.decode('utf-8'))
    )
    
    # Start the asynchronous consumer
    while True:
        try:
            await consumer.start()
            logger.info("Kafka consumer successfully connected and listening to topic...")
            break  # Exit retry loop once connected
        except Exception as e:
            logger.warn(f"Kafka broker not ready yet ({e}). Retrying in 5 seconds...")
            await asyncio.sleep(5)
    
    try:
        async for msg in consumer:
            # Extract the raw message value (assuming UTF-8 encoded string or JSON)
            # message_data = msg.value.decode('utf-8')
            logger.info(f"Received from Kafka: {msg}")
            string_payload = json.dumps(msg.value)
            # Broadcast the message to all currently connected WebSocket clients
            if CONNECTED_CLIENTS:
                # Create broadcast tasks to send to all clients concurrently
                await asyncio.gather(
                    *[client.send(string_payload) for client in CONNECTED_CLIENTS],
                    return_exceptions=True
                )
    except Exception as e:
        logger.error(f"Error in Kafka consumer loop: {e}")
    finally:
        await consumer.stop()

async def websocket_handler(websocket):
    """Handles individual incoming WebSocket connections."""
    # Register the new client connection
    CONNECTED_CLIENTS.add(websocket)
    logger.info(f"Client connected. Total clients: {len(CONNECTED_CLIENTS)}")
    
    try:
        # Keep the connection alive and listen for any messages sent by the client
        async for message in websocket:
            # Optional: handle incoming client messages here if needed
            pass
    except Exception as e:
        logger.info(f"WebSocket communication error/disconnect: {e}")
    finally:
        # Clean up when the client disconnects
        CONNECTED_CLIENTS.remove(websocket)
        logger.info(f"Client disconnected. Total clients: {len(CONNECTED_CLIENTS)}")

async def main():
    # 1. Start the WebSocket server on 0.0.0.0:8084
    ws_server = await serve(websocket_handler, "0.0.0.0", 8084)
    logger.info("WebSocket server started on ws://0.0.0.0:8084")
    
    # 2. Schedule the Kafka consumer loop to run concurrently in the background
    asyncio.create_task(kafka_consumer_task())
    
    # 3. Keep the main event loop running indefinitely
    await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server shut down manually.")
