declare module "posthog-js" {
  export type PostHogClient = {
    init: (
      apiKey: string,
      options?: {
        api_host?: string;
        capture_pageview?: boolean;
        capture_pageleave?: boolean | "if_capture_pageview";
        autocapture?: boolean;
        person_profiles?: string;
        opt_out_capturing_by_default?: boolean;
        loaded?: (instance: PostHogClient) => void;
      },
    ) => void;
    capture: (event: string, properties?: Record<string, unknown>) => void;
    identify: (
      id: string,
      properties?: Record<string, unknown>,
    ) => void;
    reset: () => void;
    opt_out_capturing: () => void;
    opt_in_capturing: () => void;
  };

  const posthog: PostHogClient;
  export default posthog;
}
