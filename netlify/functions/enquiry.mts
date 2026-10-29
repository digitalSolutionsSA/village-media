// Netlify host for the sign-up form email (server/enquiry.ts).
import { handleEnquiry } from '../../server/enquiry'

export default (req: Request) => handleEnquiry(req, process.env)

export const config = { path: '/api/enquiry' }
