# Stage 1: Build JAR using Maven
FROM maven:3.9-eclipse-temurin-17-alpine AS builder
WORKDIR /workspace

COPY pom.xml ./

# Use Google's Maven Central mirror to avoid 429 rate limits on shared build runners
RUN mkdir -p /root/.m2 && printf '%s\n' \
  '<settings>' \
  '  <mirrors>' \
  '    <mirror>' \
  '      <id>google-maven-central</id>' \
  '      <name>Google Maven Central Mirror</name>' \
  '      <url>https://maven-central.storage-download.googleapis.com/maven2</url>' \
  '      <mirrorOf>central</mirrorOf>' \
  '    </mirror>' \
  '  </mirrors>' \
  '</settings>' > /root/.m2/settings.xml

# Cache dependencies
RUN mvn dependency:go-offline -B

# Build executable JAR
COPY src src
RUN mvn clean package -DskipTests -B

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
