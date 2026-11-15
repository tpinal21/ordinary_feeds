import CarouselSettingsForm from "app/components/forms/carousel-settings-form";
import GridSettingsForm from "app/components/forms/grid-settings-form";
import { Card } from "app/components/ui/card";

const FORMS = {
  CAROUSEL: CarouselSettingsForm,
  GRID: GridSettingsForm,
};

// Create and edit render the same panel; only the feed's type picks which
// settings go in it. `page` (long form, e.g. HOME_PAGE) limits which
// galleries can be picked.
export default function FeedSettingsForm({ type, page }) {
  const Form = FORMS[type];

  if (!Form) return null;

  return (
    <div className="mt-4 max-w-4xl mx-auto w-full">
      <s-section heading="Settings">
        <Form page={page} />
      </s-section>
    </div>
  );
}
