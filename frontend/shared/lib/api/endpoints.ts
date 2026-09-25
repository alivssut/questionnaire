export const endpoints = {
    auth: {
      login: '/auth/login/',
      register: '/auth/register/',
      logout: '/auth/logout/',
      refresh: '/auth/refresh/',
      me: '/auth/me/',
      changePassword: '/auth/change-password/',
    },
    users: '/users/',
    surveys: '/surveys/',
    questions: '/surveys/questions/',
    systemLists: '/surveys/system-lists/',
    assignments: '/assignments/',
    responses: '/responses/',
    answers: '/responses/answers/',
    upload: '/responses/upload/',
    analytics: {
      global: '/analytics/global/',
      survey: (id: string) => `/analytics/surveys/${id}/`,
    },
    notifications: '/notifications/',
    activity: '/activity/',
  } as const;