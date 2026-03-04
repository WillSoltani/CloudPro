// app/app/projects/[projectId]/_lib/local-types.ts
export type StagedFile = {
    id: string;
    file: File;
    previewUrl: string;
    fromLabel: string;
    sizeLabel: string;
    selected: boolean;
    fingerprint: string;
  };
  
  export type SelectedItem = {
    id: string;
    name: string;
    sizeLabel: string;
    selected: boolean;
  };