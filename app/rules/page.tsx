import { prisma } from "@/lib/db/client";
import { createCrewRule, toggleCrewRuleActive } from "@/lib/actions/admin";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/form-field";

export default async function RulesPage() {
  const [rules, positions] = await Promise.all([
    prisma.crewRule.findMany({ orderBy: [{ active: "desc" }, { priority: "desc" }], include: { position: true } }),
    prisma.laborPosition.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Crew Rules</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hard OTL staffing rules take priority over learned historical patterns. Rules are data (a small JSON DSL), never staffing
          guesses.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Rules</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-3">Position</th>
                <th className="py-1.5 pr-3">Rule</th>
                <th className="py-1.5 pr-3">Definition</th>
                <th className="py-1.5 pr-3">Priority</th>
                <th className="py-1.5 pr-3">Status</th>
                <th className="py-1.5 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border align-top last:border-0">
                  <td className="py-2 pr-3 font-medium text-foreground">{rule.position.name}</td>
                  <td className="py-2 pr-3">
                    <p className="text-foreground">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                  </td>
                  <td className="py-2 pr-3">
                    <code className="text-xs text-muted-foreground">{JSON.stringify(rule.ruleDsl)}</code>
                  </td>
                  <td className="py-2 pr-3">{rule.priority}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={rule.active ? "success" : "neutral"}>{rule.active ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <form action={toggleCrewRuleActive.bind(null, rule.id, !rule.active)}>
                      <button type="submit" className="text-xs text-accent hover:underline">
                        {rule.active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add a Rule</CardTitle>
        </CardHeader>
        <p className="mb-4 text-xs text-muted-foreground">
          Definition is a small JSON DSL, e.g. <code>{`{"type":"ratio_ceiling","inputField":"numSimultaneousBreakoutRooms","divisor":2}`}</code>,{" "}
          <code>{`{"type":"fixed","quantity":1}`}</code>, or a <code>threshold_table</code>. See the Breakout Technician rule above for a
          worked example.
        </p>
        <form action={createCrewRule} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Position">
            <Select name="positionId" required>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" hint="Higher wins when multiple rules target the same position">
            <TextInput name="priority" type="number" defaultValue={0} />
          </Field>
          <Field label="Rule name">
            <TextInput name="name" required placeholder="Graphics Operator Ratio" />
          </Field>
          <Field label="Description">
            <TextInput name="description" required placeholder="One graphics operator whenever video scale is Large or above." />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Rule definition (JSON)">
              <TextArea name="ruleDsl" required rows={3} placeholder='{"type":"fixed","quantity":1}' className="font-mono" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Add Rule</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
