import Link from "next/link";
import { createHistoricalEvent } from "@/lib/actions/historical-events";
import { COMPLEXITY_LEVELS } from "@/lib/engine/types";
import { Field, Select, TextArea, TextInput } from "@/components/ui/form-field";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NewHistoricalShowPage() {
  return (
    <div>
      <div className="mb-6">
        <p className="text-xs text-muted-foreground">
          <Link href="/historical-shows" className="hover:underline">
            Historical Shows
          </Link>{" "}
          / Add Show
        </p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">Add Historical Show</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record a completed OTL show so it can inform future comparable-event matching. Equipment and crew line items can be added from
          the show&apos;s detail page after saving.
        </p>
      </div>

      <form action={createHistoricalEvent} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Event name *">
              <TextInput name="eventName" required placeholder="Q3 Sales Kickoff" />
            </Field>
            <Field label="Client">
              <TextInput name="clientName" />
            </Field>
            <Field label="Event type">
              <TextInput name="eventType" placeholder="Corporate Conference" />
            </Field>
            <Field label="Venue">
              <TextInput name="venueName" />
            </Field>
            <Field label="City">
              <TextInput name="city" />
            </Field>
            <Field label="State">
              <TextInput name="state" maxLength={2} />
            </Field>
            <Field label="Event date">
              <TextInput name="eventDate" type="date" />
            </Field>
            <Field label="Attendees">
              <TextInput name="attendees" type="number" min={0} />
            </Field>
            <Field label="Room sqft">
              <TextInput name="roomSqft" type="number" min={0} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rooms &amp; Schedule</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="General session rooms">
              <TextInput name="numGeneralSessionRooms" type="number" min={0} />
            </Field>
            <Field label="Breakout rooms">
              <TextInput name="numBreakoutRooms" type="number" min={0} />
            </Field>
            <Field label="Simultaneous breakout rooms">
              <TextInput name="numSimultaneousBreakoutRooms" type="number" min={0} />
            </Field>
            <Field label="Camera count">
              <TextInput name="cameraCount" type="number" min={0} />
            </Field>
            <Field label="Setup days">
              <TextInput name="setupDays" type="number" min={0} />
            </Field>
            <Field label="Rehearsal days">
              <TextInput name="rehearsalDays" type="number" min={0} />
            </Field>
            <Field label="Show days">
              <TextInput name="showDays" type="number" min={0} />
            </Field>
            <Field label="Strike days">
              <TextInput name="strikeDays" type="number" min={0} />
            </Field>
            <Field label="LED size (sqft)">
              <TextInput name="ledSizeSqft" type="number" min={0} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="projectionUsed" className="h-4 w-4 rounded border-border" />
              Projection used
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="unionLabor" className="h-4 w-4 rounded border-border" />
              Union labor
            </label>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department Complexity</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {(["audioComplexity", "videoComplexity", "ledComplexity", "lightingComplexity", "scenicComplexity"] as const).map((key) => (
              <Field key={key} label={key.replace("Complexity", "")}>
                <Select name={key} defaultValue="NONE">
                  {COMPLEXITY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financials</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Quoted amount">
              <TextInput name="quotedAmount" type="number" min={0} />
            </Field>
            <Field label="Final selling price">
              <TextInput name="finalSellingPrice" type="number" min={0} />
            </Field>
            <Field label="Discount">
              <TextInput name="discountAmount" type="number" min={0} />
            </Field>
            <Field label="Internal cost" hint="Optional — if known">
              <TextInput name="internalCost" type="number" min={0} />
            </Field>
            <Field label="Gross margin" hint="Optional — if known">
              <TextInput name="grossMargin" type="number" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <TextArea name="notes" rows={3} placeholder="Anything worth remembering about this show — change orders, complications, client feedback..." />
          <div className="mt-4">
            <Field label="Entered by" hint="Optional">
              <TextInput name="createdBy" className="max-w-xs" />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Save Show</Button>
        </div>
      </form>
    </div>
  );
}
