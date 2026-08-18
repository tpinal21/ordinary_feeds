import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "app/components/ui/card";

export const ThemeBlocksCard = ({
  blockAdded,
  viewStoreUrl,
  editThemeUrl,
  addBlockUrl,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme Blocks</CardTitle>
        <CardDescription>
          Add the Instagram feed block to your store pages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* <div className="flex justify-between items-center">
          <span className="inline-flex gap-2 items-center">
            <s-icon
              type={blockAdded ? "check-circle" : "circle-dashed"}
              tone={blockAdded ? "success" : "subdued"}
            />
            <strong>Home page</strong>
            {blockAdded ? (
              <s-badge tone="success">Added</s-badge>
            ) : (
              <s-badge tone="neutral">Not added</s-badge>
            )}
          </span>
          <span className="inline-flex gap-1 items-center">
            {blockAdded ? (
              <>
                <s-button
                  icon="view"
                  variant="tertiary"
                  href={viewStoreUrl}
                  target="_blank"
                  accessibilityLabel="View on store"
                  size="slim"
                />
                <s-button
                  variant="tertiary"
                  tone="critical"
                  href={editThemeUrl}
                  target="_blank"
                  size="slim"
                >
                  Remove
                </s-button>
              </>
            ) : (
              <s-button variant="primary" href={addBlockUrl} target="_blank">
                Add
              </s-button>
            )}
          </span>
        </div> */}
      </CardContent>
    </Card>
  );
};
