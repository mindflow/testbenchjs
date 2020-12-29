import { List, Logger } from "coreutil_v1";
import { AssertString } from "../src/testbench/assertions/assertString.js";
import { TestBench } from "../src/testbench/testBench.js";

const LOG = new Logger("TestExample");

export class TestExample {

    static testFunctions() {
        return new List([
            TestExample.prototype.testSuccess,
            TestExample.prototype.testFail
        ]);
    }

    testSuccess() {
        AssertString.assertEquals("Same", "Same");
        LOG.info("I ran");
    }

    testFail() {
        AssertString.assertEquals("But", "Different");
        LOG.info("I ran");
    }
}

new TestBench()
    .addTest(TestExample)
    .runAll();