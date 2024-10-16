import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    displayName: {
      name: 'Deobfuscator',
      color: 'blue',
    }
};
  

module.exports = config