import * as assert from "assert";
import { IPartitionLambda } from "../../kafka-service/lambdas";
import { ScriptoriumLambda } from "../../scriptorium/lambda";
import { IEvent, KafkaMessageFactory, MessageFactory, TestCollection, TestContext, TestPublisher } from "../testUtils";

describe("Routerlicious", () => {
    describe("Scriptorium", () => {
        describe("Lambda", () => {
            const testDocumentId = "test";
            const testClientId = "test";

            let testCollection: TestCollection;
            let testPublisher: TestPublisher;
            let testContext: TestContext;
            let messageFactory: MessageFactory;
            let kafkaMessageFactory: KafkaMessageFactory;
            let lambda: IPartitionLambda;

            beforeEach(() => {
                messageFactory = new MessageFactory(testDocumentId, testClientId);
                kafkaMessageFactory = new KafkaMessageFactory();

                testCollection = new TestCollection([]);
                testPublisher = new TestPublisher();
                testContext = new TestContext();
                lambda = new ScriptoriumLambda(testPublisher, testCollection, testContext);
            });

            function countOps(events: IEvent[]) {
                let count = 0;
                for (const event of events) {
                    count += event.args[1].length;
                }

                return count;
            }

            describe(".handler()", () => {
                it("Should store incoming messages to database", async () => {
                    const numMessages = 10;
                    for (let i = 0; i < numMessages; i++) {
                        const message = messageFactory.createSequencedOperation();
                        lambda.handler(kafkaMessageFactory.sequenceMessage(message, testDocumentId));
                    }
                    await testContext.waitForOffset(kafkaMessageFactory.getHeadOffset(testDocumentId));

                    assert.equal(numMessages, testCollection.collection.length);
                });

                it("Should broadcast incoming messages", async () => {
                    const numMessages = 10;
                    for (let i = 0; i < numMessages; i++) {
                        const message = messageFactory.createSequencedOperation();
                        lambda.handler(kafkaMessageFactory.sequenceMessage(message, testDocumentId));
                    }
                    await testContext.waitForOffset(kafkaMessageFactory.getHeadOffset(testDocumentId));

                    console.log(kafkaMessageFactory.getHeadOffset(testDocumentId));
                    assert.equal(
                        numMessages,
                        countOps(testPublisher.to(testDocumentId).getEvents("op")));
                });
            });
        });
    });
});
