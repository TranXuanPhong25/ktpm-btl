"use strict";

const opentelemetry = require("@opentelemetry/sdk-node");
const {
  getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");

const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-http");
const { PrometheusExporter } = require("@opentelemetry/exporter-prometheus");

const traceExporter = new OTLPTraceExporter({
  url: "http://jaeger-service:4318/v1/traces",
});

const prometheusPort = 9464;
const prometheusExporter = new PrometheusExporter(
  {
    port: prometheusPort,
    startServer: true,
  },
  () => {
    console.log(
      `✅ Prometheus scrape endpoint: http://localhost:${prometheusPort}/metrics`
    );
  }
);

const sdk = new opentelemetry.NodeSDK({
  traceExporter,
  metricReaders: [prometheusExporter],
  instrumentations: [getNodeAutoInstrumentations()],
});

try {
  sdk.start();
  console.log("✅ Tracing initialized");
} catch (error) {
  console.error("Error initializing tracing", error);
}

process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => console.log("Tracing terminated"))
    .catch((error) => console.error("Error terminating tracing", error))
    .finally(() => process.exit(0));
});
