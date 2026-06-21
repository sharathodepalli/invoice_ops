import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/pilot-leads/route";
import { withTempCwd } from "@/test-utils/fs-test-context";

let ctx: ReturnType<typeof withTempCwd>;

describe("POST /api/pilot-leads", () => {
  beforeEach(() => {
    ctx = withTempCwd();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("stores a valid pilot request", async () => {
    const res = await POST(
      new Request("http://localhost/api/pilot-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Avery Lee",
          email: "avery@example.com",
          company: "Northwind Finance",
          monthly_invoice_volume: "250",
          biggest_pain: "too many exceptions",
          notes: "Need a pilot next week",
        }),
      }),
    );

    const json = (await res.json()) as { pilot_lead: { email: string; company: string }; next_step: string };

    expect(res.status).toBe(201);
    expect(json.pilot_lead.email).toBe("avery@example.com");
    expect(json.pilot_lead.company).toBe("Northwind Finance");
    expect(json.next_step).toContain("pilot call");
  });

  it("rejects missing required fields", async () => {
    const res = await POST(
      new Request("http://localhost/api/pilot-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid", company: "" }),
      }),
    );

    const json = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("invalid_name");
  });
});
