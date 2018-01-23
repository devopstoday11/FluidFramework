import * as assert from "assert";
import { Provider } from "nconf";
import { KafkaRunnerFactory } from "../../kafka-service/runnerFactory";
import { TestKafka } from "../testUtils";
import { TestPartitionLambdaFactory } from "./testPartitionLambdaFactory";

describe("kafka-service", () => {
    describe("KafkaRunnerFactory", () => {
        let testFactory: KafkaRunnerFactory;

        beforeEach(() => {
            testFactory = new KafkaRunnerFactory();
        });

        describe(".create", () => {
            it("Should be able to create a runner", async () => {
                const config = (new Provider({})).defaults({}).use("memory");
                const testKafka = new TestKafka();
                const lambdaFactory = new TestPartitionLambdaFactory();
                const consumer = testKafka.createConsumer();

                const runner = testFactory.create(
                    {
                        config,
                        consumer,
                        dispose: () => Promise.resolve(),
                        lambdaFactory,
                    });
                assert.ok(runner);
            });
        });
    });
});
