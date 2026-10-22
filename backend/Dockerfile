FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
# Resolve dependencies first so source edits do not re-download them.
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre
RUN useradd --system --create-home --uid 10001 app \
    && mkdir -p /data/uploads && chown -R app /data
WORKDIR /app
COPY --from=build /src/target/*.jar app.jar
USER app

# Keep the heap inside the container's memory limit; the LLM runs elsewhere, so the JVM needs little.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65 -XX:+ExitOnOutOfMemoryError"
ENV APP_FILE_STORAGE_PATH=/data/uploads
EXPOSE 8080

# No actuator in this build, so "is the port open" is the cheapest honest check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD bash -c '</dev/tcp/127.0.0.1/8080' || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
