import { describe, expect, it } from "vitest";
import {
  assertPreviewOriginSurface,
  isolatedPreviewOrigin,
  mintPreviewSession,
  previewCookieName,
  previewCookieOptions,
  readPreviewSession,
} from "../src/previews.js";
import type { AppConfig } from "../src/types.js";

const config: AppConfig = {
  databaseUrl: "postgres://facility:facility@localhost:5432/facility",
  secretMasterKey: Buffer.alloc(32, 19).toString("base64"),
  port: 4400,
  publicUrl: "https://api.example.com",
  webUrl: "https://app.example.com",
  previewUrl: "https://facility-previews.example.net",
  previewSurfaceToken: "p".repeat(64),
  sandboxApiUrl: "https://api.example.com",
  sandboxGatewayUrl: "https://gateway.example.com",
  gatewayUrl: "https://gateway.example.com",
  sandboxRunnerImage: "facility-runner:dev",
  sandboxDriver: "docker",
  facilityInsecureDev: false,
  logLevel: "silent",
};

describe("isolated preview access", () => {
  it("binds preview sessions to one preview and rejects expiry, tampering, and another key", async () => {
    const now = Date.now();
    const token = await mintPreviewSession(
      config,
      { userId: "user_1", orgId: "org_1", previewId: "sbx_1" },
      now,
    );
    await expect(readPreviewSession(config, token, "sbx_1", now)).resolves.toMatchObject({
      userId: "user_1",
      orgId: "org_1",
      previewId: "sbx_1",
    });
    await expect(readPreviewSession(config, token, "sbx_2", now)).rejects.toMatchObject({
      code: "preview_access_invalid",
      statusCode: 401,
    });
    await expect(
      readPreviewSession(config, token, "sbx_1", now + 60 * 60_000),
    ).rejects.toMatchObject({ code: "preview_access_invalid", statusCode: 401 });
    await expect(readPreviewSession(config, `${token}x`, "sbx_1", now)).rejects.toMatchObject({
      code: "preview_access_invalid",
      statusCode: 401,
    });
    await expect(
      readPreviewSession(
        { ...config, secretMasterKey: Buffer.alloc(32, 20).toString("base64") },
        token,
        "sbx_1",
        now,
      ),
    ).rejects.toMatchObject({ code: "preview_access_invalid", statusCode: 401 });
  });

  it("uses a host-only, HttpOnly, per-preview cookie", () => {
    expect(previewCookieName("sbx_abc")).toBe("facility_preview_sbx_abc");
    expect(previewCookieOptions(config, "sbx_abc")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/preview/sbx_abc",
      maxAge: 3600,
    });
    expect(
      previewCookieOptions({ ...config, previewUrl: "http://preview.localhost:4400" }, "sbx_abc"),
    ).toMatchObject({ secure: false });
    expect(() => previewCookieName("../control")).toThrow("Preview access is invalid or expired");
  });

  it("enforces the two-sided host boundary before authentication", () => {
    expect(() =>
      assertPreviewOriginSurface(config, "facility-previews.example.net", "/preview/sbx_1/"),
    ).not.toThrow();
    expect(() =>
      assertPreviewOriginSurface(
        config,
        "facility-previews.example.net:443",
        "/preview-auth/sbx_1?handoff=sealed",
      ),
    ).not.toThrow();
    expect(() =>
      assertPreviewOriginSurface(config, "facility-previews.example.net", "/v1/me"),
    ).toThrowError(expect.objectContaining({ code: "not_found", statusCode: 404 }));
    expect(() =>
      assertPreviewOriginSurface(config, "app.example.com", "/preview/sbx_1/"),
    ).toThrowError(expect.objectContaining({ code: "not_found", statusCode: 404 }));
    expect(() =>
      assertPreviewOriginSurface(config, "internal-api", "/preview/sbx_1/"),
    ).toThrowError(expect.objectContaining({ code: "not_found", statusCode: 404 }));
    expect(() => assertPreviewOriginSurface(config, "internal-api", "/health")).not.toThrow();
  });

  it("accepts only the value-matched proxy marker as the preview surface", () => {
    const token = config.previewSurfaceToken as string;
    expect(() =>
      assertPreviewOriginSurface(config, "api.example.com", "/preview/sbx_1/", token),
    ).not.toThrow();
    expect(() =>
      assertPreviewOriginSurface(
        config,
        "api.example.com",
        "/preview-auth/sbx_1?handoff=sealed",
        token,
      ),
    ).not.toThrow();
    expect(() =>
      assertPreviewOriginSurface(config, "api.example.com", "/%70review/sbx_1/", token),
    ).not.toThrow();
    expect(() =>
      assertPreviewOriginSurface(config, "api.example.com", "/health", token),
    ).toThrowError(expect.objectContaining({ code: "not_found", statusCode: 404 }));

    for (const candidate of [undefined, "wrong", "p".repeat(63), [token]]) {
      expect(() =>
        assertPreviewOriginSurface(config, "api.example.com", "/preview/sbx_1/", candidate),
      ).toThrowError(expect.objectContaining({ code: "not_found", statusCode: 404 }));
    }
  });

  it("ignores marker headers when no trusted marker is configured", () => {
    const hostOnlyConfig = { ...config, previewSurfaceToken: undefined };
    expect(() =>
      assertPreviewOriginSurface(
        hostOnlyConfig,
        "api.example.com",
        "/preview/sbx_1/",
        config.previewSurfaceToken,
      ),
    ).toThrowError(expect.objectContaining({ code: "not_found", statusCode: 404 }));
    expect(() =>
      assertPreviewOriginSurface(
        hostOnlyConfig,
        "facility-previews.example.net",
        "/preview/sbx_1/",
        config.previewSurfaceToken,
      ),
    ).not.toThrow();
  });

  it("requires separation at the registered-site boundary", () => {
    expect(isolatedPreviewOrigin({ ...config, previewUrl: "https://previews.example.com" })).toBe(
      false,
    );
    expect(
      isolatedPreviewOrigin({
        ...config,
        publicUrl: "https://d111111abcdef8.cloudfront.net",
        previewUrl: "https://d222222abcdef8.cloudfront.net",
      }),
    ).toBe(true);
  });
});
