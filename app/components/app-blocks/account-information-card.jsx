import { DisconnectButton } from "app/components/app-blocks/disconnect-button";
import { InstagramLogo } from "app/components/icons/instagram-logo";

export const AccountInformationCard = ({ instagramAccount }) => {
  return (
    <s-section>
      <s-stack direction="block" gap="small">
        <s-heading>Account Information</s-heading>
        <div className="flex justify-between items-center">
          <span className="inline-flex gap-2 items-center">
            <InstagramLogo />
            <strong>@{instagramAccount?.username}</strong>
          </span>
          <DisconnectButton />
        </div>
      </s-stack>
    </s-section>
  );
};
