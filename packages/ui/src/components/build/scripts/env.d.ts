// The bundler gives the text of a file for an import that ends in `?raw`.
declare module '*?raw' {
  const text: string;
  export default text;
}
