using Amazon.S3;
using BlobUpload.Data;
using Microsoft.EntityFrameworkCore;
using Confluent.Kafka;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var env = builder.Environment.EnvironmentName;

builder.Configuration
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{env}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

// Configure the S3 client to point at your MinIO server instance
var s3Config = new AmazonS3Config
{
    ServiceURL = builder.Configuration["AmazonS3Bucket:ServiceURL"], // Your MinIO Host Endpoint
    ForcePathStyle = true                 // CRITICAL: Tells AWS SDK to use MinIO URL formatting
};

var minioAccessKey = builder.Configuration["Minio:AccessKey"];
var minioSecretKey = builder.Configuration["Minio:SecretKey"];

builder.Services.AddSingleton<IAmazonS3>(new AmazonS3Client(minioAccessKey, minioSecretKey, s3Config));

// Kafka Producer Setup 
var producerConfig = new ProducerConfig
{
    BootstrapServers = builder.Configuration["Kafka:Url"], // Update to your broker string
    Acks = Acks.All,
    EnableIdempotence = true,
    SocketConnectionSetupTimeoutMs = 5000,
    MessageTimeoutMs = 5000
};

// Registered as a Singleton across the application lifetime
builder.Services.AddSingleton<IProducer<string, string>>(sp =>
    new ProducerBuilder<string, string>(producerConfig).Build());


// Temp CORS
// 2. Add CORS services to the Dependency Injection container
//builder.Services.AddCors(options =>
//{
//    options.AddPolicy(name: "CorsPolicy",
//        policy =>
//        {
//            policy.WithOrigins("http://localhost:4200") // Your frontend URL
//                  .AllowAnyMethod()                     // Allows PUT, POST, OPTIONS, GET
//                  .AllowAnyHeader()                     // Allows custom auth/content headers
//                  .AllowCredentials();                  // Optional: Allows cookies/auth tokens
//        });
//});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// For CORS
//app.UseCors("CorsPolicy");
//app.UseRouting();

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

var retryCount = 0;
var maxRetries = 5;

while (retryCount < maxRetries)
{
    try
    {
        using (var scope = app.Services.CreateScope())
        {
            var services = scope.ServiceProvider;
            var context = services.GetRequiredService<ApplicationDbContext>();

            // Check if connection can be opened before applying changes
            await context.Database.CanConnectAsync();
            await context.Database.EnsureCreatedAsync();
            break; // Success, exit loop
        }
    }
    catch (Exception ex)
    {
        retryCount++;
        if (retryCount >= maxRetries) throw;

        // Wait 5 seconds before trying again
        await Task.Delay(5000);
    }
}

app.Run();
