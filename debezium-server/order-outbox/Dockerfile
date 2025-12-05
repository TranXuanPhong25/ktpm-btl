FROM debezium/server:2.5

# Copy configuration
COPY application.properties /debezium/conf/

# Expose health check port (optional)
EXPOSE 8080

CMD ["/debezium/run.sh"]
