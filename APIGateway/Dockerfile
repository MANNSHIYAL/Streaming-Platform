# Stage 1: Base runtime environment
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

# Stage 2: SDK image for compiling the application
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
WORKDIR /src

# Copy project file first to utilize Docker layer caching for dependencies
COPY ["APIGateway.csproj", "./"]
RUN dotnet restore "APIGateway.csproj"

# Copy the remaining source files and build the app
COPY . .
RUN dotnet build "APIGateway.csproj" -c Release -o /app/build

# Stage 3: Publish the compiled binaries
FROM build AS publish
RUN dotnet publish "APIGateway.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 4: Final deployment image
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Run as a non-root system user for production security
USER $APP_UID

ENTRYPOINT ["dotnet", "APIGateway.dll"]
