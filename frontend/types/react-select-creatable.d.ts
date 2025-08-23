// Type shim for react-select Creatable subpath to satisfy TS under bundler resolution
declare module "react-select/creatable" {
  const CreatableSelect: any;
  export default CreatableSelect;
}
