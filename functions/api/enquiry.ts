// Cloudflare Pages host for the sign-up form email (server/enquiry.ts), at /api/enquiry.
import { handleEnquiry, type EnquiryEnv } from '../../server/enquiry'

export const onRequest = ({ request, env }: { request: Request; env: EnquiryEnv }) => handleEnquiry(request, env)
