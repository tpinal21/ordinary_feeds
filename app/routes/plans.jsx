import { delay, enter } from "app/lib/animations";
import { apiFetch } from "app/lib/api-client";
import { getBillingState } from "app/lib/billing.server";
import {
  FAIR_USE_MAX_FEEDS,
  FREE_PLAN,
  PLANS,
  TRIAL_DAYS,
} from "app/lib/plans";
import { authenticate } from "app/shopify.server";
import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";

// The shop's plan and trial, read from Shopify on every visit, so coming back
// from Shopify's approval screen shows the new plan straight away.
export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  try {
    return {
      billing: await getBillingState(admin, session.shop),
      error: null,
    };
  } catch (err) {
    console.error("[plans] billing read failed", err);
    return { billing: null, error: "billing_unavailable" };
  }
}

const formatPrice = (price) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
  }).format(price);

const formatDate = (iso) =>
  new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(
    new Date(iso),
  );

const DOWNGRADE_MODAL_ID = "downgrade-to-free";

export default function Plans() {
  const { billing, error } = useLoaderData();
  const revalidator = useRevalidator();
  const current = billing?.planId ?? FREE_PLAN;
  const [yearly, setYearly] = useState(billing?.interval === "yearly");
  // The plan whose button is waiting on the server.
  const [pending, setPending] = useState(null);
  const trialDays = billing?.trialDaysLeft ?? TRIAL_DAYS;

  const choosePlan = async (planId) => {
    setPending(planId);
    try {
      const res = await apiFetch("/api/billing", {
        method: "POST",
        body: { plan: planId, interval: yearly ? "yearly" : "monthly" },
      });
      if (!res?.success) throw new Error(res?.error);

      if (res.confirmationUrl) {
        // Shopify's approval screen lives in the admin, outside the app's
        // iframe; it sends the merchant back to this page afterwards.
        window.open(res.confirmationUrl, "_top");
        return;
      }
      // Back to Free: nothing to approve.
      document.getElementById(DOWNGRADE_MODAL_ID)?.hideOverlay?.();
      shopify.toast.show("You're on the Free plan");
      revalidator.revalidate();
      setPending(null);
    } catch {
      shopify.toast.show("Couldn't change your plan", { isError: true });
      setPending(null);
    }
  };

  return (
    <s-page heading="Plans" inlineSize="base">
      {error && (
        <div className="mb-4">
          <s-banner tone="critical">
            Couldn&apos;t load your current plan. Refresh the page to try again.
          </s-banner>
        </div>
      )}
      {billing?.trialEndsAt && (
        <div className={`mb-4 ${enter}`}>
          <s-banner tone="info">
            Your free trial ends on {formatDate(billing.trialEndsAt)}. You
            won&apos;t be charged before then, and canceling before it ends
            costs nothing.
          </s-banner>
        </div>
      )}

      <div
        className={`flex flex-wrap items-center justify-between gap-3 mb-4 ${enter}`}
      >
        <s-text color="subdued">
          {trialDays > 0
            ? `Pick the plan that fits your store. Paid plans start with a ${trialDays}-day free trial.`
            : "Pick the plan that fits your store. Change or cancel anytime."}
        </s-text>
        <BillingToggle yearly={yearly} onChange={setYearly} />
      </div>

      <s-query-container>
        <s-grid
          gridTemplateColumns="@container (inline-size > 720px) 1fr 1fr 1fr, 1fr"
          gap="base"
        >
          {PLANS.map((plan, i) => (
            <div
              key={plan.id}
              className={`h-full ${enter}`}
              style={delay(75 * (i + 1))}
            >
              <PlanCard
                plan={plan}
                yearly={yearly}
                // The same plan on the other billing period is still a
                // change the merchant can make.
                current={
                  plan.id === current &&
                  (plan.id === FREE_PLAN ||
                    billing?.interval === (yearly ? "yearly" : "monthly"))
                }
                onCurrentPlan={plan.id === current}
                trialDays={current === FREE_PLAN ? trialDays : 0}
                loading={pending === plan.id}
                disabled={!!error || (!!pending && pending !== plan.id)}
                onChoose={() =>
                  plan.id === FREE_PLAN
                    ? document.getElementById(DOWNGRADE_MODAL_ID)?.showOverlay()
                    : choosePlan(plan.id)
                }
              />
            </div>
          ))}
        </s-grid>
      </s-query-container>

      <p className="mt-3 text-xs text-neutral-500">
        Unlimited feeds are subject to fair use, up to {FAIR_USE_MAX_FEEDS} per
        store.
      </p>

      <s-modal id={DOWNGRADE_MODAL_ID} heading="Switch to the Free plan?">
        <s-paragraph>
          Your paid plan is canceled right away and you lose its features. Feeds
          beyond the Free plan&apos;s limits stop showing on your store.
        </s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          loading={pending === FREE_PLAN}
          onClick={() => choosePlan(FREE_PLAN)}
        >
          Switch to Free
        </s-button>
        <s-button
          slot="secondary-actions"
          commandfor={DOWNGRADE_MODAL_ID}
          command="--hide"
        >
          Keep my plan
        </s-button>
      </s-modal>
    </s-page>
  );
}

// Monthly / Yearly switch; yearly is about two months free.
const BillingToggle = ({ yearly, onChange }) => (
  <div
    role="radiogroup"
    aria-label="Billing period"
    className="inline-flex rounded-lg bg-neutral-200 p-0.5 text-sm"
  >
    {[
      { value: false, label: "Monthly" },
      { value: true, label: "Yearly", note: "2 months free" },
    ].map((option) => (
      <button
        key={option.label}
        type="button"
        role="radio"
        aria-checked={yearly === option.value}
        onClick={() => onChange(option.value)}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 cursor-pointer ${
          yearly === option.value
            ? "bg-white font-semibold shadow-sm"
            : "text-neutral-600"
        }`}
      >
        {option.label}
        {option.note && (
          <span className="text-xs font-medium text-green-700">
            {option.note}
          </span>
        )}
      </button>
    ))}
  </div>
);

const PlanCard = ({
  plan,
  yearly,
  current,
  onCurrentPlan,
  trialDays,
  loading,
  disabled,
  onChoose,
}) => {
  const free = plan.id === FREE_PLAN;
  const price = yearly ? plan.yearly : plan.monthly;
  const offersTrial = !free && trialDays > 0;

  const buttonLabel = current
    ? "Current plan"
    : onCurrentPlan
      ? `Switch to ${yearly ? "yearly" : "monthly"}`
      : free
        ? "Switch to Free"
        : offersTrial
          ? `Start ${trialDays}-day free trial`
          : `Choose ${plan.name}`;

  return (
    <div
      className={`h-full flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm border ${
        plan.recommended ? "border-neutral-900" : "border-neutral-200"
      }`}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <s-heading>{plan.name}</s-heading>
          {onCurrentPlan ? (
            <s-badge tone="success">Current plan</s-badge>
          ) : (
            plan.recommended && <s-badge tone="info">Recommended</s-badge>
          )}
        </div>
        <s-text color="subdued">{plan.description}</s-text>
      </div>

      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold">
            {free ? "Free" : formatPrice(price)}
          </span>
          {!free && (
            <s-text color="subdued">{yearly ? "/ year" : "/ month"}</s-text>
          )}
        </div>
        <span className="text-xs text-neutral-500 min-h-4">
          {free
            ? "Free forever"
            : yearly
              ? `${formatPrice(plan.yearly / 12)} / month, billed yearly`
              : "Billed monthly"}
        </span>
      </div>

      {/* Only while the shop still has trial days to give. */}
      {offersTrial && (
        <div className="flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1.5 text-sm text-green-800">
          <s-icon type="gift-card" size="small" />
          <span>
            <strong>{trialDays}-day free trial</strong>, cancel anytime
          </span>
        </div>
      )}

      <ul className="flex flex-col gap-2 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <s-icon type="check" tone="success" size="small" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <s-button
        variant={plan.recommended && !current ? "primary" : "secondary"}
        disabled={current || disabled}
        loading={loading}
        onClick={onChoose}
      >
        {buttonLabel}
      </s-button>
    </div>
  );
};
