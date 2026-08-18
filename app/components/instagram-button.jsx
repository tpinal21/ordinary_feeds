import { useState } from "react";
import { useRevalidator } from "react-router";
import { InstagramLogo } from "app/components/icons/instagram-logo";
import { useMutation } from "app/hooks/useMutation";
import { apiFetch } from "app/lib/api-client";

function formatRelative(iso) {
  if (!iso) return "now";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function InstagramButton({ account }) {
  const revalidator = useRevalidator();
  const [syncMessage, setSyncMessage] = useState(null);

  const { trigger: triggerConnect, isMutating: connecting } = useMutation(
    "instagram-connect",
    () => apiFetch("/auth/instagram/start", { method: "POST" }),
    {
      onSuccess: (data) => {
        if (data?.url) window.top.location.href = data.url;
      },
    },
  );

  const { trigger: triggerDisconnect, isMutating: disconnecting } = useMutation(
    "instagram-disconnect",
    () => apiFetch("/api/instagram/disconnect", { method: "POST" }),
    {
      onSuccess: () => {
        revalidator.revalidate();
      },
    },
  );

  if (account?.username) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <InstagramLogo />
            <span>
              Connected as <strong>@{account.username}</strong>
            </span>
          </div>
          <div className="flex gap-2">
            {/* <s-button
              variant="primary"
              onClick={triggerSync}
              {...(syncing ? { loading: true } : {})}
            >
              Sync now
            </s-button> */}
            <s-button
              variant="secondary"
              onClick={triggerDisconnect}
              {...(disconnecting ? { loading: true } : {})}
              tone="critical"
              accessibilityLabel="Disconnect Instagram account"
            >
              Disconnect
            </s-button>
          </div>
        </div>
        <div className="text-xs text-neutral-500">
          Last synced: {formatRelative(account.last_synced_at)}
          {syncMessage && <> · {syncMessage}</>}
          {account.last_sync_error && !syncMessage && (
            <>
              {" "}
              ·{" "}
              <span className="text-red-600">
                Last error: {account.last_sync_error}
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <s-button
      variant="primary"
      onClick={triggerConnect}
      {...(connecting ? { loading: true } : {})}
    >
      <div className="flex items-center gap-1.5">
        <InstagramLogo />
        Connect your Instagram
      </div>
    </s-button>
  );
}
