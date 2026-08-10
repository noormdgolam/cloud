import { signInWithGitHub, signInWithGoogle } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/Button";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.15.8 3.87 1.5l2.64-2.55C16.86 3.36 14.66 2.4 12 2.4 6.98 2.4 2.9 6.5 2.9 11.6S6.98 20.8 12 20.8c6.93 0 8.3-4.85 8.3-7.36 0-.5-.05-.86-.12-1.24H12z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-ink" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.21.66.79.55A10.51 10.51 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5Z" />
    </svg>
  );
}

export function OAuthButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <form action={signInWithGoogle}>
        <Button type="submit" variant="ghost" className="w-full">
          <GoogleMark />
          Google
        </Button>
      </form>
      <form action={signInWithGitHub}>
        <Button type="submit" variant="ghost" className="w-full">
          <GitHubMark />
          GitHub
        </Button>
      </form>
    </div>
  );
}
