import { useEffect, useId } from "react";
import { FormProvider } from "react-hook-form";

export default function AppBridgeForm({
  showSaveBar = true,
  children,
  onSubmit,
  ...formMethods
}) {
  const id = useId();

  const {
    formState: { isDirty, isSubmitting },
    handleSubmit,
    reset,
  } = formMethods;

  const resetForm = () => reset(undefined, { keepDirty: false });

  useEffect(() => {
    if (!showSaveBar) return;
    if (isDirty) {
      shopify.saveBar.show(id);
    } else {
      shopify.saveBar.hide(id);
    }
  }, [showSaveBar, isDirty, id]);

  return (
    <FormProvider {...formMethods}>
      {showSaveBar && (
        <ui-save-bar id={id}>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            variant="primary"
            loading={isSubmitting ? "" : undefined}
          />
          <button type="button" onClick={resetForm} disabled={isSubmitting} />
        </ui-save-bar>
      )}
      <form onSubmit={handleSubmit(onSubmit)}>{children}</form>
    </FormProvider>
  );
}
