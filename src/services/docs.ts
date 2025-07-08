import { google, docs_v1, drive_v3 } from "googleapis";


export class DocsService {
  private docs: docs_v1.Docs;
  private drive: drive_v3.Drive;
  private shareWith: string | null;

  constructor(emailToShare?: string) {
    const auth = new google.auth.GoogleAuth({
      scopes: [
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/drive.file",
      ],
    });
    this.docs  = google.docs({ version: "v1", auth });
    this.drive = google.drive({ version: "v3", auth });
    this.shareWith = emailToShare ?? null;
  }

  async createDoc(title: string, content: string) {
    const { data } = await this.docs.documents.create({ requestBody: { title } });
    const id = data.documentId!;
    const len = content.length + 1;
    
    await this.docs.documents.batchUpdate({
  documentId: id,
  requestBody: {
    requests: [
      /* 1. הכנסת הטקסט (index 1 = אחרי start-of-document) */
      {
        insertText: {
          location: { index: 1 },
          text: content
        }
      },
      /* 2. כיוון RTL לפסקאות שהכנסנו */
      {
        updateParagraphStyle: {
          range: { startIndex: 1, endIndex: len },
          paragraphStyle: { direction: "RIGHT_TO_LEFT" },
          fields: "direction"
        }
      }
    ]
  }
});

    /* שיתוף עם המייל שלך */
    if (this.shareWith) {
      await this.drive.permissions.create({
        fileId: id,
        requestBody: { type: "user", role: "writer", emailAddress: this.shareWith },
        sendNotificationEmail: false,
      });
    }
    return `https://docs.google.com/document/d/${id}`;
  }
}