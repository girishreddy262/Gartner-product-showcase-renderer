/**
 * Asset URLs — all Dropbox-hosted, matching the editor exactly.
 * These are baked in so the renderer can fetch them at render time.
 */

export const ASSETS = {
  callout: "https://dl.dropboxusercontent.com/scl/fi/brez2pmx6malb0vvxagea/callout.svg?rlkey=2k2thsd5tqu97uj9nh03zhzik&dl=1",
  videoFrame: "https://dl.dropboxusercontent.com/scl/fi/wqy7jnvjl3xmepv7ww6yi/video-frame.png?rlkey=57idx9mxvogzax53gasprftgm&dl=1",
  keyGoalIcon: "https://dl.dropboxusercontent.com/scl/fi/f2s97zhwu7gcekkdgkpy1/key-goal-icon.svg?rlkey=0zl6udlss12ycjxgbhrfzojcp&dl=1",
  moduleIcons: {
    'core-hr': "https://dl.dropboxusercontent.com/scl/fi/w1bh5xalxzgr77nx33hch/intro-icon-core-hr.svg?rlkey=annz90q732saxbh9kk2oo36ke&dl=1",
    'compensation-management': "https://dl.dropboxusercontent.com/scl/fi/gltuq8sx3soutcp44rnz5/intro-icon-Compensation-Management.svg?rlkey=0pvsjxz1gzea1x30ds35wy77x&dl=1",
    'recruitment': "https://dl.dropboxusercontent.com/scl/fi/i5797ox7hfpildaw829hv/intro-icon-Management-Recruitment.svg?rlkey=80w0p9cc6az3ncc0cfqu9bl49&dl=1",
    'global-payroll': "https://dl.dropboxusercontent.com/scl/fi/nwnb85e8x3qehqiz2ed5a/intro-icon-Global-Payroll.svg?rlkey=canxushno5d4wsvsoyy5m286e&dl=1",
    'employee-experience': "https://dl.dropboxusercontent.com/scl/fi/9gkfaai91w5krninm62eh/intro-icon-Employee-Experience.svg?rlkey=rbgscvfy2n9ehtba4lfxdf6wj&dl=1",
    'workforce-management': "https://dl.dropboxusercontent.com/scl/fi/n3nuaaratcfuvauauv03q/intro-icon-Workforce-Management.svg?rlkey=hgurdhpzc12e98a8q4fvljy0i&dl=1",
    'extensibility-suite': "https://dl.dropboxusercontent.com/scl/fi/xyjwfo4x1yc0lko8ek0kx/intro-icon-Extensibility-Suite.svg?rlkey=5n1ow9kuny1yilr3sg1khxi1v&dl=1",
    'hr-service-management': "https://dl.dropboxusercontent.com/scl/fi/ty9iyxb801lywahi6qfyd/intro-icon-HR-Service-Management.svg?rlkey=7byaanq7fq8e7l443twvlewmx&dl=1",
    'global-benefits-management': "https://dl.dropboxusercontent.com/scl/fi/xctatfec5miggxrmg8z2g/intro-icon-Global-Benefits-Management.svg?rlkey=jl5ibhn78xuowg8m6jnbl1csc&dl=1",
    'people-reporting-analytics': "https://dl.dropboxusercontent.com/scl/fi/mmb3n93c6akycoxvy84g9/intro-icon-People-Reporting-Analytics.svg?rlkey=j0nuauk5hi31oahmsqnd2v7rd&dl=1",
  } as Record<string, string>,
  focusIcons: {
    'always-intelligent': "https://dl.dropboxusercontent.com/scl/fi/7qxjpdukyiua1pb6jldnc/focus-icon-Always-Intelligent.svg?rlkey=v9tukz6lo17jugdu93ua0tao8&dl=1",
    'compliance': "https://dl.dropboxusercontent.com/scl/fi/ihtk1timc1yerb7fezi2f/focus-icon-Compliance.svg?rlkey=jsyst4dq6xz57k67y3u4d7ra6&dl=1",
    'core': "https://dl.dropboxusercontent.com/scl/fi/2ben8pjjpwsk3q9o9yx28/focus-icon-Core.svg?rlkey=rr17yt5fzms0yutspiha48rz1&dl=1",
    'hr-processes': "https://dl.dropboxusercontent.com/scl/fi/j7mzyn8zp85cx6yx6iygd/focus-icon-HR-Processes.svg?rlkey=mj8ebl38igydx58fmhdq8z434&dl=1",
    'local-precision': "https://dl.dropboxusercontent.com/scl/fi/3grg2miysm0zt23d96fbd/focus-icon-Local-Precision.svg?rlkey=vcq8f3n0t33vg7ycvt22hhwn8&dl=1",
    'manager-empowerment': "https://dl.dropboxusercontent.com/scl/fi/d3sciili9np8tuni2y6kn/focus-icon-Manager-Empowerment.svg?rlkey=mw2lim96u21rvw0ifo0y4be65&dl=1",
    'transparency': "https://dl.dropboxusercontent.com/scl/fi/q4k10rv8hhfcq6i348158/focus-icon-Transparency.svg?rlkey=elubgyyvu5hw3mu9xwvw760u3&dl=1",
    'governance': "https://dl.dropboxusercontent.com/scl/fi/9yqyknnipffdh5k38r7lg/focus-icon-governance.svg?rlkey=fj8u27nlccvqasbe4ot5cn2jw&dl=1",
  } as Record<string, string>,
  personas: [
    { id: 'aiden-lee', name: 'Aiden Lee', designation: 'Head of TA', url: "https://dl.dropboxusercontent.com/scl/fi/lnvmaime33hx4gjm9c1yj/Aiden-Lee.png?rlkey=ios37qok27g5uv07knoxvie8g&dl=1" },
    { id: 'rachel-palmer', name: 'Rachel Palmer', designation: 'Recruiter', url: "https://dl.dropboxusercontent.com/scl/fi/l2x4ltvib1jxzyg360rvk/Rachel-Palmer.png?rlkey=ks5pra3pjjns5rkfudwi518wj&dl=1" },
    { id: 'amy-brooke', name: 'Amy Brooke', designation: 'Candidate', url: "https://dl.dropboxusercontent.com/scl/fi/q7snm28kym3k5hgxuhqdx/Amy-Brooke.png?rlkey=zjt9mst1hyx2253g4p89ayv01&dl=1" },
    { id: 'emma-grace', name: 'Emma Grace', designation: 'Hiring Manager', url: "https://dl.dropboxusercontent.com/scl/fi/5v0yk1vn91it664tvx3pb/Emma-Grace.png?rlkey=cfmf2z63ob6uxx2bdge5f7sr0&dl=1" },
    { id: 'gabriel-mendoza', name: 'Gabriel Mendoza', designation: 'Interviewer', url: "https://dl.dropboxusercontent.com/scl/fi/ivaq8sdsafd9v4rd5xv7x/Gabriel-Mendoza.png?rlkey=luq6hp8hx9wxf9uos9qspdstr&dl=1" },
    { id: 'britta-seegar', name: 'Britta Seegar', designation: 'Manager R&D', url: "https://dl.dropboxusercontent.com/scl/fi/qg7i2l46xm7r377akxjmw/Britta-Seegar.png?rlkey=tvgkwdkdh6fjd3m7ascxwrn5s&dl=1" },
  ],
  fonts: {
    regular: "https://dl.dropboxusercontent.com/scl/fi/1igp7lctqr0cyi0lr7yoo/Satoshi-Regular.otf?rlkey=2bi7mdhxi0v5lkfuice7kqlvd&dl=1",
    medium: "https://dl.dropboxusercontent.com/scl/fi/grw89j321m9gepjdk4a42/Satoshi-Medium.otf?rlkey=s3m20yeim8f8nv4eulqy4x61x&dl=1",
    bold: "https://dl.dropboxusercontent.com/scl/fi/w3rl42fasm279kkonqm22/Satoshi-Bold.otf?rlkey=yjb726yddcgg6k9nnylsm0v8p&dl=1",
    black: "https://dl.dropboxusercontent.com/scl/fi/ni565rbaboat9j5ilw86l/Satoshi-Black.otf?rlkey=r6auugaxek1k92ddx44t9f02m&dl=1",
    italic: "https://dl.dropboxusercontent.com/scl/fi/1pwn9vu24oc4m0u0zyiyc/Satoshi-Italic.otf?rlkey=2eem6ujzjqluj12tw2fist71b&dl=1",
    boldItalic: "https://dl.dropboxusercontent.com/scl/fi/3lup216o8kvhfh0speq4j/Satoshi-BoldItalic.otf?rlkey=lbg31lvxiorpxa6wtdr8i3q87&dl=1",
  },
};

export function getModuleIconUrl(id: string | null): string | null {
  if (!id) return null;
  return ASSETS.moduleIcons[id] || null;
}

export function getFocusIconUrl(id: string | null): string | null {
  if (!id) return null;
  return ASSETS.focusIcons[id] || null;
}

export function getPersonaById(id: string | null) {
  if (!id) return null;
  return ASSETS.personas.find(p => p.id === id) || null;
}
