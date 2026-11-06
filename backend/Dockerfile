# Stage 1: Build JAR using Maven Wrapper
FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /workspace

RUN apk add --no-cache bash

COPY mvnw pom.xml ./
COPY .mvn .mvn

# Clean CRLF line endings from Windows checkouts
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw

# Cache dependencies
RUN ./mvnw dependency:go-offline -B

# Build executable JAR
COPY src src
RUN ./mvnw clean package -DskipTests -B

# Stage 2: Minimal Production JRE Runtime
FROM eclipse-temurin:17-jre-alpine AS runner
WORKDIR /app

RUN apk add --no-cache git && addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=builder /workspace/target/*.jar app.jar

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
ENV SERVER_PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=5s --start-period=35s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
