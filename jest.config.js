module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        "@/(.*)": "<rootDir>/src/$1"
    },
    globalSetup: './test/globalSetup.js',
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.json'
        }
    },
    setupFiles: ['dotenv/config']
};
