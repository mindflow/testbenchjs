export class TestClassState {

    static get RUNNING() { return 0; }
    static get SUCCESS() { return 1; }
    static get FAIL() { return -1; }

    /**
     * 
     * @param {String} className 
     * @param {String} state 
     */
    constructor(className, state) {

        /** @type {String} */
        this.className = className;
        
        /** @type {String} */
        this.state = state;
    }
}