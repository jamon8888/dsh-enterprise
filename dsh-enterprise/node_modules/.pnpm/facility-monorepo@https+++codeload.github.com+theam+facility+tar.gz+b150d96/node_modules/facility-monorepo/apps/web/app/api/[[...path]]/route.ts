import { proxyApiRequest } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";

const handler = (request: Request) => proxyApiRequest(request);

export const GET = handler;
export const HEAD = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
