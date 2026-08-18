import { DisconnectButton } from "app/components/app-blocks/disconnect-button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "app/components/ui/card";
import { InstagramLogo } from "app/components/icons/instagram-logo";

export const AccountInformationCard = ({ instagramAccount }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Information</CardTitle>
        <CardDescription>
          <div className="flex justify-between items-center">
            <span className="inline-flex gap-2 items-center">
              <InstagramLogo />
              <strong>@{instagramAccount?.username}</strong>
            </span>
            <DisconnectButton />
          </div>
        </CardDescription>
      </CardHeader>
    </Card>
  );
};
