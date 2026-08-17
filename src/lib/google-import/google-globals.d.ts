// Single source of truth for the `window.google`/`window.gapi` ambient
// types this feature needs — kept in one .d.ts so auth.ts and
// drive-picker.ts (which both touch `window.google`) don't produce
// conflicting global augmentations (TS requires every `declare global`
// block for the same property to be structurally identical, not unioned).

type GoogleOAuth2TokenResponse = { access_token?: string; expires_in?: number; error?: string };

type GoogleOAuth2TokenClient = {
  requestAccessToken: (opts: { prompt: string }) => void;
};

type GoogleDocsView = {
  setIncludeFolders: (include: boolean) => GoogleDocsView;
  setSelectFolderEnabled: (enabled: boolean) => GoogleDocsView;
};

type GooglePickerInstance = { setVisible: (visible: boolean) => void };

type GooglePickerBuilder = {
  addView: (view: GoogleDocsView | string) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setAppId: (id: string) => GooglePickerBuilder;
  setCallback: (cb: (data: Record<string, unknown>) => void) => GooglePickerBuilder;
  enableFeature: (feature: string) => GooglePickerBuilder;
  build: () => GooglePickerInstance;
};

declare global {
  interface Window {
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleOAuth2TokenResponse) => void;
            error_callback?: (err: { message?: string }) => void;
          }) => GoogleOAuth2TokenClient;
        };
      };
      picker?: {
        PickerBuilder: new () => GooglePickerBuilder;
        DocsView: new (viewId: string) => GoogleDocsView;
        ViewId: { DOCS: string };
        Action: { PICKED: string; CANCEL: string; LOADED: string };
        Feature: { MULTISELECT_ENABLED: string };
        Response: { ACTION: string; DOCUMENTS: string };
        Document: { ID: string; NAME: string; MIME_TYPE: string; SIZE_BYTES: string };
      };
    };
  }
}

export {};
