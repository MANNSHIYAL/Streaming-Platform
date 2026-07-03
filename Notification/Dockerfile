# Use an official lightweight Python image
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the functional working directory inside the container
WORKDIR /app

# Copy only requirements first to leverage Docker layer caching
COPY requirements.txt .

# Install dependencies without installing local caches
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY sendNotification.py .

# Expose the WebSocket server port
EXPOSE 8084

# Run the asynchronous server
CMD ["python", "sendNotification.py"]
