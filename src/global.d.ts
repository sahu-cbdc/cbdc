
declare global {
  var CBDCShared: any;
  interface Window {
    CBDCShared: any;
    [key: string]: any;
  }
}

export {};
