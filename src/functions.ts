import {SayHelloProps} from './types';

export function sayHello({name}: SayHelloProps) {
  console.log(`Hello, ${name}!`);
  return;
}