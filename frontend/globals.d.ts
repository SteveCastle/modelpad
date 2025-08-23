type SaveFilePickerOptions = {
  suggestedName: string | undefined;
  types: [
    {
      description: string;
      accept: {
        "text/markdown": [string];
        "text/plain": [string];
      };
    }
  ];
};

type OpenFilePickerOptions = {
  types: [
    {
      description: string;
      accept: {
        "text/markdown": [string];
        "text/plain": [string];
      };
    }
  ];
};

interface Window {
  showOpenFilePicker: (
    options: OpenFilePickerOptions
  ) => Promise<[FileSystemFileHandle]>;
  showSaveFilePicker: (
    options: SaveFilePickerOptions
  ) => Promise<FileSystemFileHandle>;
}

// Temporary shim for react-select Creatable subpath types when using bundler resolution
declare module "react-select/creatable" {
  const CreatableSelect: any;
  export default CreatableSelect;
}
