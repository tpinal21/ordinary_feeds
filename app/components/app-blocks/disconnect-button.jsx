import { useState } from "react";
import { useNavigate, useRevalidator } from "react-router";
import { useMutation } from "app/hooks/useMutation";
import { apiFetch } from "app/lib/api-client";
import { Modal, TitleBar } from "@shopify/app-bridge-react";

export const DisconnectButton = () => {
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { trigger: triggerDisconnect, isMutating: disconnecting } = useMutation(
    "instagram-disconnect",
    () => apiFetch("/api/instagram/disconnect", { method: "POST" }),
    {
      onSuccess: () => {
        revalidator.revalidate();
        navigate("/setup");
      },
    },
  );

  return (
    <>
      <s-button
        variant="tertiary"
        onClick={() => setOpen(true)}
        loading={disconnecting ? "" : undefined}
        tone="critical"
      >
        Disconnect
      </s-button>
      {open && (
        <Modal open={open} onClose={() => setOpen(false)}>
          <TitleBar title="Are you sure?">
            <button onClick={() => setOpen(false)}>Cancel</button>
            <button
              variant="primary"
              tone="critical"
              onClick={triggerDisconnect}
            >
              Disconnect
            </button>
          </TitleBar>
        </Modal>
      )}
    </>
  );
};
