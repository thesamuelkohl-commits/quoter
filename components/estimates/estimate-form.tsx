import type { ComplexityLevel, Department } from "@/lib/engine/types";
import { Field, TextArea, TextInput } from "@/components/ui/form-field";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComplexityPicker } from "./complexity-picker";
import { AddOnPicker, type AddOnOption } from "./addon-picker";

// OTL calls each of these a "package" (Audio Package, Lighting Package, etc.) —
// except crew (handled separately by the crew engine) and transportation/Trucking,
// which stay plain department names.
const DEPARTMENT_SECTIONS: { department: Department; label: string; description: string }[] = [
  { department: "AUDIO", label: "Audio Package", description: "Console, PA, wireless mics, monitors" },
  { department: "VIDEO", label: "Video Package", description: "IMAG / projection — switching, cameras, confidence monitors" },
  { department: "STREAMING", label: "Streaming Package", description: "Encoding, bandwidth, platform delivery, captioning" },
  { department: "LED", label: "LED Package", description: "LED panels, processing, rigging frame" },
  { department: "LIGHTING", label: "Lighting Package", description: "Moving lights, console, truss, effects" },
  { department: "SCENIC", label: "Scenic Package", description: "Stage decking, backdrops, drape, podiums" },
  { department: "COMMUNICATIONS", label: "Communications Package", description: "Intercom, radios, IFB" },
  { department: "RIGGING", label: "Rigging Package", description: "Motors, ground support, point engineering" },
  { department: "TRUCKING", label: "Trucking / Freight", description: "Truck(s) and cartage — transportation, not a package" },
  { department: "TRAVEL", label: "Travel Package", description: "Flights, hotel nights, per diem, ground transport" },
  { department: "OTHER", label: "Other Package", description: "Insurance, site survey, misc." },
];

export interface EstimateFormValues {
  eventName?: string;
  clientName?: string;
  attendees?: number | null;
  roomSqft?: number | null;
  targetBudget?: number | null;
  numGeneralSessionRooms?: number | null;
  numBreakoutRooms?: number | null;
  numSimultaneousBreakoutRooms?: number | null;
  showStartDate?: string;
  showEndDate?: string;
  hoursPerDay?: number | null;
  setupDays?: number | null;
  rehearsalDays?: number | null;
  showDays?: number | null;
  strikeDays?: number | null;
  darkDays?: number | null;
  unionLabor?: boolean;
  isTravelGig?: boolean;
  isHoliday?: boolean;
  specialRequirements?: string;
  createdBy?: string;
  departments?: Partial<Record<Department, { complexityLevel: ComplexityLevel; notes?: string | null; cameraCount?: number; projectionUsed?: boolean; ledSizeSqft?: number }>>;
  selectedAddOnIds?: string[];
}

export function EstimateForm({
  action,
  defaultValues = {},
  submitLabel = "Generate Estimate",
  addOns = [],
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultValues?: EstimateFormValues;
  submitLabel?: string;
  addOns?: AddOnOption[];
}) {
  const v = defaultValues;
  // Expanded by default only when editing an estimate that already has data here —
  // a brand new estimate starts with just Event Basics and Rooms & Schedule showing.
  const hasAdvancedDetails =
    Object.values(v.departments ?? {}).some((d) => d.complexityLevel !== "NONE") ||
    (v.selectedAddOnIds?.length ?? 0) > 0 ||
    Boolean(v.specialRequirements);

  // Department pickers are an exclusive accordion (see `name="department-picker"`
  // below) — only one can default open, or the browser's native exclusivity
  // silently overrides the server-rendered state and causes a hydration mismatch.
  const defaultOpenDepartment =
    DEPARTMENT_SECTIONS.find((s) => v.departments?.[s.department]?.complexityLevel !== "NONE" && v.departments?.[s.department])?.department ??
    "AUDIO";

  return (
    <form action={action} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Event Basics</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Event name *">
            <TextInput name="eventName" required defaultValue={v.eventName ?? "Orange Thread Live"} placeholder="Acme Corp Annual Sales Kickoff" />
          </Field>
          <Field label="Client">
            <TextInput name="clientName" defaultValue={v.clientName ?? "Orange Thread Live"} placeholder="Acme Corporation" />
          </Field>
          <Field label="Attendees">
            <TextInput name="attendees" type="number" min={0} defaultValue={v.attendees ?? undefined} placeholder="500" />
          </Field>
          <Field label="Room square footage">
            <TextInput name="roomSqft" type="number" min={0} defaultValue={v.roomSqft ?? undefined} placeholder="12000" />
          </Field>
          <Field label="Target budget" hint="Optional — used later for scope-adjustment suggestions">
            <TextInput name="targetBudget" type="number" min={0} defaultValue={v.targetBudget ?? undefined} placeholder="45000" />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="isTravelGig" defaultChecked={v.isTravelGig} className="h-4 w-4 rounded border-border" />
          Travel gig (crew travel required — leave unchecked for in-town/local market)
        </label>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rooms &amp; Schedule</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Show start date *" hint="First show day — anchors the whole schedule so weekend work can be detected">
            <TextInput name="showStartDate" type="date" required defaultValue={v.showStartDate} />
          </Field>
          <Field label="Show end date" hint="Optional — cross-checked against the day counts below; mismatches are flagged, not blocked">
            <TextInput name="showEndDate" type="date" defaultValue={v.showEndDate} />
          </Field>
          <Field label="General session rooms">
            <TextInput name="numGeneralSessionRooms" type="number" min={0} defaultValue={v.numGeneralSessionRooms ?? undefined} placeholder="1" />
          </Field>
          <Field label="Breakout rooms">
            <TextInput name="numBreakoutRooms" type="number" min={0} defaultValue={v.numBreakoutRooms ?? 0} placeholder="6" />
          </Field>
          <Field label="Simultaneous breakout rooms" hint="Defaults to all breakout rooms if left blank">
            <TextInput name="numSimultaneousBreakoutRooms" type="number" min={0} defaultValue={v.numSimultaneousBreakoutRooms ?? 0} placeholder="4" />
          </Field>
          <Field label="Expected hours / show day" hint="12 standard · 1.25x day rate 12–14hrs · 1.5x 14–16hrs · capped at 16">
            <TextInput name="hoursPerDay" type="number" min={1} max={16} defaultValue={v.hoursPerDay ?? undefined} placeholder="12" />
          </Field>
          <Field label="Setup days" hint="Leave at 0 if setup happens same-day as the show">
            <TextInput name="setupDays" type="number" min={0} defaultValue={v.setupDays ?? 0} placeholder="2" />
          </Field>
          <Field label="Rehearsal days" hint="Leave at 0 if rehearsal happens same-day as the show">
            <TextInput name="rehearsalDays" type="number" min={0} defaultValue={v.rehearsalDays ?? undefined} placeholder="0" />
          </Field>
          <Field label="Show days">
            <TextInput name="showDays" type="number" min={0} defaultValue={v.showDays ?? undefined} placeholder="2" />
          </Field>
          <Field label="Strike days" hint="Leave at 0 if strike happens same-day as the show">
            <TextInput name="strikeDays" type="number" min={0} defaultValue={v.strikeDays ?? 0} placeholder="1" />
          </Field>
          <Field label="Dark/dead days" hint="On-site but no crew activity — still counts toward gear rental length">
            <TextInput name="darkDays" type="number" min={0} defaultValue={v.darkDays ?? 0} placeholder="0" />
          </Field>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" name="unionLabor" defaultChecked={v.unionLabor} className="h-4 w-4 rounded border-border" />
            Union labor / venue-required union house
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" name="isHoliday" defaultChecked={v.isHoliday} className="h-4 w-4 rounded border-border" />
            Holiday show (+10% crew cost surcharge)
          </label>
        </div>
      </Card>

      <details className="group" open={hasAdvancedDetails}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-border bg-surface px-5 py-4 shadow-sm">
          <span>
            <span className="text-sm font-semibold text-foreground">Department Requirements, Add-Ons &amp; Notes</span>
            <span className="ml-2 text-xs text-muted-foreground">Optional — expand to specify audio/video/lighting/etc., add-ons, or notes. Defaults apply if skipped.</span>
          </span>
          <span className="shrink-0 text-xs font-medium text-accent group-open:hidden">Show</span>
          <span className="hidden shrink-0 text-xs font-medium text-accent group-open:inline">Hide</span>
        </summary>

        <div className="mt-6 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Department Requirements</CardTitle>
            </CardHeader>
            <p className="mb-4 text-xs text-muted-foreground">
              Pick a scale for anything the event needs. Leave a department at &quot;Not Needed&quot; if it isn&apos;t required — it will be
              excluded from the estimate.
            </p>
            <div className="flex flex-col divide-y divide-border">
              {DEPARTMENT_SECTIONS.map((section) => {
                const dep = v.departments?.[section.department];
                const openByDefault = section.department === defaultOpenDepartment;
                return (
                  <details key={section.department} name="department-picker" className="py-3 first:pt-0 last:pb-0" open={openByDefault}>
                    <summary className="flex cursor-pointer items-center justify-between gap-3">
                      <span>
                        <span className="text-sm font-medium text-foreground">{section.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{section.description}</span>
                      </span>
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      <Field label="Scale">
                        <ComplexityPicker
                          name={`dept_${section.department}`}
                          defaultValue={dep?.complexityLevel ?? "NONE"}
                          department={section.department}
                        />
                      </Field>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {section.department === "VIDEO" && (
                          <>
                            <Field label="Camera count">
                              <TextInput name="cameraCount" type="number" min={0} defaultValue={dep?.cameraCount} placeholder="2" />
                            </Field>
                            <label className="flex items-end gap-2 pb-2 text-sm text-foreground">
                              <input type="checkbox" name="projectionUsed" defaultChecked={dep?.projectionUsed} className="h-4 w-4 rounded border-border" />
                              Projection required
                            </label>
                          </>
                        )}
                        {section.department === "LED" && (
                          <Field label="LED size (sqft)">
                            <TextInput name="ledSizeSqft" type="number" min={0} defaultValue={dep?.ledSizeSqft} placeholder="400" />
                          </Field>
                        )}
                        <Field label="Notes">
                          <TextInput name={`dept_${section.department}_notes`} defaultValue={dep?.notes ?? undefined} placeholder="Optional specifics" />
                        </Field>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </Card>

          {addOns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Add-Ons</CardTitle>
              </CardHeader>
              <p className="mb-4 text-xs text-muted-foreground">Optional flat-fee extras — click any that apply.</p>
              <AddOnPicker options={addOns} selectedIds={v.selectedAddOnIds} />
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Other Requirements</CardTitle>
            </CardHeader>
            <Field label="Special requirements / notes" hint="Free text — scanned for department and scheduling signals to suggest as assumptions">
              <TextArea name="specialRequirements" rows={4} defaultValue={v.specialRequirements} placeholder="e.g. Client wants an LED wall behind the main stage, IMAG with two cameras, union house, same-day turn between rooms..." />
            </Field>
            <div className="mt-4">
              <Field label="Your name" hint="Optional — recorded on the estimate">
                <TextInput name="createdBy" defaultValue={v.createdBy} placeholder="Jordan Smith" className="max-w-xs" />
              </Field>
            </div>
          </Card>
        </div>
      </details>

      <div className="flex justify-end gap-3">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
