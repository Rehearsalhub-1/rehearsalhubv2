import 'react-native';

declare global {
  // eslint-disable-next-line no-var
  var global: typeof globalThis;
  namespace NodeJS {
    type Timeout = ReturnType<typeof setTimeout>;
  }
}

declare module 'react-native' {
  namespace StyleSheet {
    export const absoluteFillObject: {
      position: 'absolute';
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
    };
  }
}
