import CarouselSettingsForm from "app/components/forms/carousel-settings-form";
import GridSettingsForm from "app/components/forms/grid-settings-form";
import { Card } from "app/components/ui/card";

const FORMS = {
  CAROUSEL: CarouselSettingsForm,
  GRID: GridSettingsForm,
};

// Create and edit render the same panel; only the feed's type picks which
// settings go in it.
export default function FeedSettingsForm({ type }) {
  const Form = FORMS[type];

  if (!Form) return null;

  return (
    <Card className="flex flex-col gap-4 mt-2 px-3 max-w-4xl mx-auto w-full">
      <Form />
    </Card>
  );
}
