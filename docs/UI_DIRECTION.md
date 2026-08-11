# UI DIRECTION

## MVP Screens

### 1. Authentication

- Register screen: name, email, password, submit, validation message.
- Login screen: email, password, submit, validation message.
- Successful authentication redirects to the task area.
- Authentication requests use credentials so the HttpOnly cookie is sent.

### 2. Todo List

- Header: current user, logout, navigation to Calendar and Chatbot.
- Toolbar: search, date filter, status filter, priority filter, category filter.
- Task form: title, description, task_date, start_time, end_time, priority, category_id.
- Task item: title, date/time, priority, category, status, edit, complete, delete.
- Delete requires confirmation.
- Conflict response shows the conflicting task and offers change time, cancel, or continue.

### 3. Calendar

- Month, Week and Day views.
- Events are converted from the same Task data used by Todo List.
- Selecting an event opens task details/edit flow.
- Create/update/delete/complete changes refresh both Todo List and Calendar.

### 4. Chatbot

- Message list, input box and send action.
- Clarification responses show the missing field that user must provide.
- Ambiguous task results show choices instead of auto-selecting.
- Delete and conflict actions require confirmation.
- After a successful task action, refresh Todo List and Calendar.

## Navigation

```text
Login/Register
      |
Task Area
  |       |       |
Todo   Calendar  Chatbot
```

Dashboard is optional and is not part of the MVP navigation.
