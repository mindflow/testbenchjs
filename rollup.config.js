import multiEntry from 'rollup-plugin-multi-entry';
import postprocess from 'rollup-plugin-postprocess';
import copy from 'rollup-plugin-copy';
import uglify from "rollup-plugin-uglify-es";

export default [{
    input: "src/**/*.js",
    external: [ 'coreutil_v1' ],
    output: {
        name: 'testbench_v1',
        file: "dist/jsm/testbench_v1.js",
        sourcemap: "inline",
        format: "es"
    },
    plugins: [
        multiEntry(),
        postprocess([
            [/(?<=import\s*(.*)\s*from\s*)['"]((?!.*[.]js).*)['"];/, '\'./$2.js\'']
        ]),
        //uglify()
    ]
},{
    input: "src/**/*.js",
    external: [ 'coreutil_v1' ],
    output: {
        name: 'testbench_v1',
        file: "dist/cjs/testbench_v1.js",
        sourcemap: "inline",
        format: "cjs"
    },
    plugins: [
        multiEntry(),
        copy({
            targets: [
              { src: 'src/**/*.css', dest: 'dist/assets/testbenchjs' },
              { src: 'src/**/*.html', dest: 'dist/assets/testbenchjs' }
            ],
            verbose: true
        }),
        //uglify()
    ]
}]
