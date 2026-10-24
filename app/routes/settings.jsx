import AppBridgeForm from "app/components/app-bridge-form";
import { InstagramLogo } from "app/components/icons/instagram-logo";
import { useMutation } from "app/hooks/useMutation";
import { delay, enter } from "app/lib/animations";
import { apiFetch } from "app/lib/api-client";
import {
  APP_SETTINGS_DEFAULTS,
  CLICK_ACTIONS,
  POST_TYPES,
} from "app/lib/app-settings";
import { getAppSettings } from "app/lib/app-settings.server";
import {
  BORDER_RADIUS_MAX,
  GRID_COLUMNS,
  GRID_ROWS,
  ITEM_GAP_MAX,
} from "app/lib/feeds";
import { authenticate } from "app/shopify.server";
import { Controller, useForm, useFormContext } from "react-hook-form";
import { useLoaderData, useOutletContext } from "react-router";

const RESET_MODAL_ID = "reset-settings-modal";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  return { settings: await getAppSettings(admin) };
}

const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

// Polaris selects and number fields hold strings; the server parses them back
// to numbers when it normalizes the settings.
const toFormValues = (settings) => ({
  ...settings,
  feed_defaults: {
    ...settings.feed_defaults,
    border_radius: String(settings.feed_defaults.border_radius),
    item_gap: String(settings.feed_defaults.item_gap),
    columns: String(settings.feed_defaults.columns),
    rows: String(settings.feed_defaults.rows),
  },
});

export default function Settings() {
  const { settings } = useLoaderData();
  const { shopDetails } = useOutletContext();

  const formMethods = useForm({ defaultValues: toFormValues(settings) });
  const { reset } = formMethods;

  const instagramAccount = shopDetails?.instagram_account?.find(
    (acc) => acc.status == "CONNECTED",
  );

  const onSaved = (successMessage) => (res) => {
    if (!res.success) {
      shopify.toast.show(res.error || "Couldn't save settings", {
        isError: true,
      });
      return;
    }

    shopify.toast.show(successMessage);
    // Reset onto the saved values so they become the new defaults — that's
    // what clears the save bar.
    reset(toFormValues(res.data), { keepDirty: false });
  };

  const { trigger: save, isMutating: saving } = useMutation(
    "app-settings",
    ({ arg }) => apiFetch("/api/settings", { method: "POST", body: arg }),
    {
      throwOnError: false,
      onSuccess: onSaved("Settings saved"),
      onError: () =>
        shopify.toast.show("Couldn't save settings", { isError: true }),
    },
  );

  return (
    <s-page heading="Settings" inlineSize="small">
      <AppBridgeForm {...formMethods} onSubmit={(values) => save(values)}>
        <InstagramSection account={instagramAccount} />
        <s-section
          heading="Storefront"
          subheading="Control whether and where feeds appear in your online store."
          className={enter}
          style={delay(75)}
        >
          <Controller
            control={formMethods.control}
            name="storefront_enabled"
            render={({ field }) => (
              <s-switch
                label="Show feeds on your storefront"
                details="Turn off to hide every feed from customers without deleting any."
                checked={!!field.value}
                onChange={(e) => field.onChange(e.target.checked)}
              />
            )}
          />
        </s-section>
        <FeedDefaultsSection />
        <PostsSection />
        <PostClicksSection />

        <ToolsSection
          resetting={saving}
          onReset={() =>
            save(APP_SETTINGS_DEFAULTS, {
              onSuccess: onSaved("Settings reset"),
            })
          }
        />

        <s-stack
          alignItems="center"
          paddingBlock="large"
          className={enter}
          style={delay(450)}
        >
          <s-text color="subdued">
            Learn more about{" "}
            <s-link
              href="https://help.shopify.com/manual/online-store/themes/theme-structure/extend/apps"
              target="_blank"
            >
              adding app blocks to your theme
            </s-link>
            .
          </s-text>
        </s-stack>
      </AppBridgeForm>
    </s-page>
  );
}

function InstagramSection({ account }) {
  return (
    <s-section
      heading="Connected accounts"
      subheading="Your feeds show posts from the Instagram account connected here."
      className={enter}
    >
      <s-section>
        {account ? (
          <s-stack direction="block" gap="small-300">
            <div className="w-full flex justify-between items-start">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <InstagramLogo />
                <s-text>
                  {account.name || account.username}
                  {account.media_count != null &&
                    ` · ${account.media_count.toLocaleString()} posts`}
                  {account.followers_count != null &&
                    ` · ${account.followers_count.toLocaleString()} followers`}
                </s-text>
              </s-stack>
              <s-button>Change account</s-button>
            </div>
            <s-paragraph color="subdued">
              {`Account connected on ${formatDateTime(account.connected_at)}.`}
            </s-paragraph>
            {account.last_sync_error && (
              <s-banner tone="critical" heading="The last sync failed">
                <s-paragraph>{account.last_sync_error}</s-paragraph>
              </s-banner>
            )}
          </s-stack>
        ) : (
          <s-paragraph color="subdued">
            Connect an Instagram professional account to start showing posts on
            your store.
          </s-paragraph>
        )}
      </s-section>
    </s-section>
  );
}

// The server falls back to the default for anything it can't parse, so catch a
// cleared or out-of-range field here instead of saving a value nobody typed.
const pixelRules = (max) => ({
  required: "Enter a number",
  validate: (value) =>
    (/^\d+$/.test(value) && Number(value) <= max) ||
    `Enter a whole number from 0 to ${max}`,
});

function FeedDefaultsSection() {
  const { control } = useFormContext();

  return (
    <s-section
      heading="New feed defaults"
      subheading="Feeds you create start with these settings. Existing feeds keep their own."
      className={enter}
      style={delay(150)}
    >
      <s-stack direction="block" gap="base">
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <Controller
            control={control}
            name="feed_defaults.border_radius"
            rules={pixelRules(BORDER_RADIUS_MAX)}
            render={({ field, fieldState }) => (
              <s-number-field
                label="Corner radius"
                suffix="px"
                min={0}
                max={BORDER_RADIUS_MAX}
                step={1}
                value={field.value}
                error={fieldState.error?.message}
                onInput={(e) => field.onChange(e.target.value)}
              />
            )}
          />
          <Controller
            control={control}
            name="feed_defaults.item_gap"
            rules={pixelRules(ITEM_GAP_MAX)}
            render={({ field, fieldState }) => (
              <s-number-field
                label="Space between posts"
                suffix="px"
                min={0}
                max={ITEM_GAP_MAX}
                step={1}
                value={field.value}
                error={fieldState.error?.message}
                onInput={(e) => field.onChange(e.target.value)}
              />
            )}
          />
          <Controller
            control={control}
            name="feed_defaults.columns"
            render={({ field }) => (
              <s-select
                label="Grid columns"
                details="Grid feeds only"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              >
                {GRID_COLUMNS.map((n) => (
                  <s-option key={n} value={String(n)}>
                    {n}
                  </s-option>
                ))}
              </s-select>
            )}
          />
          <Controller
            control={control}
            name="feed_defaults.rows"
            render={({ field }) => (
              <s-select
                label="Grid rows"
                details="Grid feeds only"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              >
                {GRID_ROWS.map((n) => (
                  <s-option key={n} value={String(n)}>
                    {n}
                  </s-option>
                ))}
              </s-select>
            )}
          />
        </s-grid>
        <Controller
          control={control}
          name="feed_defaults.media_auto_play"
          render={({ field }) => (
            <s-switch
              label="Autoplay videos"
              details="Videos play muted as soon as they're on screen."
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
          )}
        />
      </s-stack>
    </s-section>
  );
}

function PostsSection() {
  const { control } = useFormContext();

  return (
    <s-section
      heading="Posts"
      subheading="Choose which Instagram posts your feeds show."
      className={enter}
      style={delay(225)}
    >
      <s-stack direction="block" gap="base">
        <Controller
          control={control}
          name="content.post_types"
          render={({ field }) => (
            <s-choice-list
              label="Post types"
              multiple
              onChange={(e) => field.onChange(e.currentTarget.values)}
            >
              {POST_TYPES.map((type) => (
                <s-choice
                  key={type.value}
                  value={type.value}
                  selected={!!field.value.includes(type.value)}
                >
                  {type.label}
                </s-choice>
              ))}
            </s-choice-list>
          )}
        />
        <Controller
          control={control}
          name="content.show_captions"
          render={({ field }) => (
            <s-switch
              label="Show captions"
              details="Show each post's Instagram caption under it."
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
          )}
        />
      </s-stack>
    </s-section>
  );
}

function PostClicksSection() {
  const { control } = useFormContext();

  return (
    <s-section
      heading="Post clicks"
      subheading="What happens when customers interact with your feeds."
      className={enter}
      style={delay(300)}
    >
      <s-stack direction="block" gap="base">
        <Controller
          control={control}
          name="click.action"
          render={({ field }) => (
            <s-select
              label="When a customer clicks a post"
              details="Posts without a tagged product open on Instagram instead."
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
            >
              {CLICK_ACTIONS.map((action) => (
                <s-option key={action.value} value={action.value}>
                  {action.label}
                </s-option>
              ))}
            </s-select>
          )}
        />
      </s-stack>
    </s-section>
  );
}

function ToolsSection({ resetting, onReset }) {
  return (
    <>
      <s-section
        heading="Tools"
        subheading="Manage your app configuration."
        className={enter}
        style={delay(375)}
      >
        <s-section
          heading="Reset settings"
          subheading="Return every setting on this page to its default. Your feeds and connected account aren't affected."
        >
          <s-button
            slot="secondary-actions"
            tone="critical"
            commandfor={RESET_MODAL_ID}
            command="--show"
          >
            Reset
          </s-button>
        </s-section>
      </s-section>
      <s-modal id={RESET_MODAL_ID} heading="Reset all settings?">
        <s-text>
          {
            "Every setting on this page goes back to its default. This can't be undone."
          }
        </s-text>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandfor={RESET_MODAL_ID}
          command="--hide"
          onClick={onReset}
          loading={!!resetting}
        >
          Reset settings
        </s-button>
        <s-button
          slot="secondary-actions"
          commandfor={RESET_MODAL_ID}
          command="--hide"
        >
          Cancel
        </s-button>
      </s-modal>
    </>
  );
}
