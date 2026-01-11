export {};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          prompt: (callback?: (notification: { isNotDisplayed?: () => boolean }) => void) => void;
        };
      };
    };
  }
}
