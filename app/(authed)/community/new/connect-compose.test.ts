import { describe, it, expect } from "vitest";
import {
  type ConnectTarget,
  connectMentionMarker,
  connectInitialTitle,
  connectComposeBody,
  joinTopics,
  toggleTopic,
} from "./connect-compose";

// Unit coverage for the GUIDED "connect with this person" composer logic — the
// pre-scoped message + topic-selection behavior that shapes what gets posted (and
// therefore who gets notified). Pure functions, no rendering / DB.

const target: ConnectTarget = {
  signupId: "11111111-1111-4111-8111-111111111111",
  name: "Jane Doe",
  topics: ["Fundraising", "Product", "Hiring"],
};

describe("connectMentionMarker", () => {
  it("references the target by their signup id in the shared marker format", () => {
    // MUST be the exact @[Name](id) marker the server re-resolves + notifies on —
    // this is what auto-attaches the person to the connection post.
    expect(connectMentionMarker(target)).toBe("@[Jane Doe](11111111-1111-4111-8111-111111111111)");
  });
});

describe("connectInitialTitle", () => {
  it("names the person so the post is obviously about connecting with them", () => {
    expect(connectInitialTitle(target)).toBe("Connect with Jane Doe");
  });
});

describe("joinTopics", () => {
  it("handles 0/1/2/3 topics with natural grammar", () => {
    expect(joinTopics([])).toBe("");
    expect(joinTopics(["Product"])).toBe("Product");
    expect(joinTopics(["Product", "Hiring"])).toBe("Product and Hiring");
    expect(joinTopics(["Fundraising", "Product", "Hiring"])).toBe(
      "Fundraising, Product, and Hiring",
    );
  });

  it("drops blanks", () => {
    expect(joinTopics(["Product", "", "Hiring"])).toBe("Product and Hiring");
  });
});

describe("connectComposeBody", () => {
  it("always leads with the target mention so they're referenced + notified", () => {
    const body = connectComposeBody(target, []);
    expect(body).toContain(connectMentionMarker(target));
  });

  it("with no topics, produces a complete, sendable greeting", () => {
    expect(connectComposeBody(target, [])).toBe(
      "Hi @[Jane Doe](11111111-1111-4111-8111-111111111111) — I'd love to connect.",
    );
  });

  it("weaves the selected topics into the message", () => {
    expect(connectComposeBody(target, ["Product", "Hiring"])).toBe(
      "Hi @[Jane Doe](11111111-1111-4111-8111-111111111111) — I'd love to connect about Product and Hiring.",
    );
  });
});

describe("toggleTopic", () => {
  const all = target.topics;

  it("adds an unselected topic", () => {
    expect(toggleTopic(all, [], "Product")).toEqual(["Product"]);
  });

  it("removes an already-selected topic", () => {
    expect(toggleTopic(all, ["Product", "Hiring"], "Product")).toEqual(["Hiring"]);
  });

  it("de-dupes case-insensitively and does not double-add", () => {
    expect(toggleTopic(all, ["Product"], "product")).toEqual([]);
  });

  it("keeps selection in the original topic order regardless of pick order", () => {
    // Pick Hiring (index 2) then Fundraising (index 0) — result follows all-order.
    const afterHiring = toggleTopic(all, [], "Hiring");
    const afterFundraising = toggleTopic(all, afterHiring, "Fundraising");
    expect(afterFundraising).toEqual(["Fundraising", "Hiring"]);
  });
});
