export class AssertString {

    static assertEquals(expected, actual) {
        if (expected === actual) {
            return;
        }
        throw "String Assertion Failed. Expected: '" + expected + "' Actual: '" + actual + "'";
    }

}