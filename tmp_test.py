import traceback
try:
    import backend.main
    print('SUCCESS')
except Exception as e:
    with open('error.log', 'w') as f:
        traceback.print_exc(file=f)
    print('FAILED')
