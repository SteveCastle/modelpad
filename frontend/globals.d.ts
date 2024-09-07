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
